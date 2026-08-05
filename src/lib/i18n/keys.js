/**
 * Message keys are dot-separated, so runtime ids that contain a dot
 * (`0.6B`, `TextEncodeAceStepAudio1.5`) need the dot swapped before lookup.
 */
export function toKeySegment(value) {
  return String(value ?? '').replace(/\./g, '_');
}
