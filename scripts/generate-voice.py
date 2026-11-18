"""Render the game's Thai dialogue with a local Thonburian F5 model."""

import argparse
from contextlib import nullcontext
import json
from pathlib import Path
import tempfile

def trim_padding(signal, sample_rate):
    """Keep short guards around the voiced region for subtitle and pause timing."""
    import numpy as np

    window = max(1, sample_rate // 100)
    frames = signal[:len(signal) // window * window]
    if not len(frames):
        return signal
    bins = frames.reshape(-1, window, *signal.shape[1:])
    axes = tuple(range(1, bins.ndim))
    energy = np.sqrt(np.mean(bins ** 2, axis=axes))
    active = np.flatnonzero(energy > max(.0045, energy.max() * .022))
    if not active.size:
        return signal

    start = max(0, (active[0] - 9) * window)
    stop = min(len(signal), (active[-1] + 12) * window)
    start = max(0, min(start, stop - int(sample_rate * .24)))
    trimmed = signal[start:stop].copy()
    fade = min(len(trimmed) // 2, int(sample_rate * .006))
    if fade:
        envelope = np.linspace(0, 1, fade).reshape((fade,) + (1,) * (signal.ndim - 1))
        if start:
            trimmed[:fade] *= envelope
        if stop < len(signal):
            trimmed[-fade:] *= envelope[::-1]
    return trimmed


def main():
    project = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--vocab", type=Path, required=True)
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--reference-text", required=True)
    parser.add_argument("--output-dir", type=Path, default=project / "public" / "stillwater-voice")
    parser.add_argument("--dialogue", type=Path, default=project / "src" / "dialogue.json")
    parser.add_argument("--line", action="append", help="Render only these line IDs.")
    parser.add_argument("--steps", type=int, default=24)
    parser.add_argument("--cpu-bf16", action="store_true", help="Use BF16 autocast on a supported CPU.")
    args = parser.parse_args()

    import numpy as np
    import soundfile as sf
    import torch
    from flowtts.inference import AudioConfig, FlowTTSPipeline, ModelConfig

    lines = json.loads(args.dialogue.read_text(encoding="utf-8"))
    ids = args.line or list(lines)
    if unknown := set(ids) - lines.keys():
        parser.error(f"Unknown dialogue IDs: {', '.join(sorted(unknown))}")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        torch.set_num_threads(min(4, torch.get_num_threads()))
    model = ModelConfig(
        language="th", model_type="F5", checkpoint=str(args.checkpoint.resolve()),
        vocab_file=str(args.vocab.resolve()), vocoder="vocos", device=device,
    )
    audio = AudioConfig(cfg_strength=2.5, nfe_step=args.steps, speed=1.0)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output_dir / "manifest.json"
    files = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

    with tempfile.TemporaryDirectory() as temporary:
        pipeline = FlowTTSPipeline(model_config=model, audio_config=audio, temp_dir=temporary)
        for line_id in ids:
            wav = Path(temporary) / f"{line_id}.wav"
            with torch.inference_mode(), (
                torch.autocast("cpu", dtype=torch.bfloat16) if args.cpu_bf16 and device == "cpu" else nullcontext()
            ):
                pipeline(
                    text=lines[line_id], ref_voice=str(args.reference.resolve()), ref_text=args.reference_text,
                    output_file=str(wav), speed=1.0, check_duration=True,
                )
            signal, sample_rate = sf.read(wav, dtype="float32")
            signal = trim_padding(signal, sample_rate)
            peak = float(np.max(np.abs(signal)))
            minimum = .22 if line_id in {"sigh", "laugh"} else .45
            if signal.shape[0] < sample_rate * minimum or peak < .02:
                raise RuntimeError(f"Clip sounds empty or incomplete: {line_id}")
            name = f"{line_id}.flac"
            target = args.output_dir / name
            sf.write(target.with_suffix(".tmp"), signal * min(2.0, .77 / peak), sample_rate, format="FLAC")
            target.with_suffix(".tmp").replace(target)
            files[line_id] = name
            print(f"{line_id}: {signal.shape[0] / sample_rate:.2f}s on {device}", flush=True)

    manifest_path.write_text(json.dumps(files, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
