# Security Exception Register

This register records production dependency advisories that are present in the
locked dependency tree but have limited reachability in Leaf's current code.
It is not a claim that an advisory is harmless, and it does not suppress the
`npm audit --audit-level=high --omit=dev` gate in CI.

## Review Policy

- Reassess every entry before the next release.
- Reassess when upgrading the affected dependency or its parent, or when
  adding image processing, archive handling, or ONNX Runtime installation
  behavior.
- Prefer an upstream-compatible dependency update over an override. A root
  override outside a parent's declared range requires a clean-install and
  platform-build validation before it can be accepted.
- Do not release with an unresolved entry unless the project maintainer records
  an explicit, time-bounded risk acceptance in the release issue.

## Current Assessment

Assessment date: 2026-07-25

`npm audit --audit-level=high --omit=dev` reports four high-severity records.
They describe two vulnerable leaf packages and their parent dependency paths,
not four independent Leaf code paths.

### Sharp

- **Advisory:** [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj)
- **Resolved package and dependency path:** `sharp@0.34.5` via
  `@huggingface/transformers@4.2.0`.
- **Current reachability:** Leaf uses Transformers for local Whisper
  automatic-speech-recognition in [src/main/services/speech.ts](src/main/services/speech.ts).
  It does not import Sharp, call Transformers image APIs, or pass vault images
  to Transformers.
- **Residual risk and required action:** The vulnerable Sharp/libvips path could
  become reachable if image processing or Transformers image features are
  added. `npm audit` identifies `sharp >=0.35.0` as patched. Do not force that
  version until an upstream-compatible update is available or the override has
  been validated across supported platforms.

### adm-zip

- **Advisory:** [GHSA-xcpc-8h2w-3j85](https://github.com/advisories/GHSA-xcpc-8h2w-3j85)
- **Resolved package and dependency path:** `adm-zip@0.5.18` via
  `onnxruntime-node@1.27.0`, and via `@huggingface/transformers@4.2.0` ->
  `onnxruntime-node@1.24.3`.
- **Current reachability:** ONNX Runtime uses `adm-zip` in its installation
  script to unpack downloaded native-binary NuGet packages. Leaf does not
  expose ZIP import or extraction as an application feature, and inference does
  not use this install helper.
- **Residual risk and required action:** A compromised or malicious archive
  received during dependency installation could cause resource exhaustion.
  `npm audit` identifies `adm-zip >=0.6.0` as patched. Do not force that version
  until an upstream-compatible update is available or the override has been
  validated across supported platforms.

## Evidence and Limits

- The assessment describes the current code and dependency lockfile only; it
  does not replace vulnerability remediation.
- Both packages are production dependencies and remain subject to the CI audit
  gate until resolved or explicitly accepted for a specific release.
- The audit findings must be revisited after any `package-lock.json` update.
