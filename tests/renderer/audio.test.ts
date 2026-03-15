import { describe, it, expect } from 'vitest';
import { audioBufferToWav, arrayBufferToBase64 } from '../../src/renderer/utils/audio';

/** Create a minimal AudioBuffer-shaped object for testing. */
function makeAudioBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
    return {
        numberOfChannels: channels.length,
        sampleRate,
        length: channels[0].length,
        duration: channels[0].length / sampleRate,
        getChannelData(ch: number) {
            return channels[ch];
        },
    } as AudioBuffer;
}

describe('audio utilities', () => {
    describe('arrayBufferToBase64', () => {
        it('encodes an empty buffer', () => {
            expect(arrayBufferToBase64(new ArrayBuffer(0))).toBe('');
        });

        it('encodes a single byte', () => {
            const buf = new Uint8Array([65]).buffer; // 'A'
            expect(arrayBufferToBase64(buf)).toBe('QQ==');
        });

        it('encodes a known byte sequence', () => {
            // "Hello" → SGVsbG8=
            const buf = new Uint8Array([72, 101, 108, 108, 111]).buffer;
            expect(arrayBufferToBase64(buf)).toBe('SGVsbG8=');
        });

        it('round-trips with atob', () => {
            const original = new Uint8Array([0, 127, 255, 1, 42]);
            const b64 = arrayBufferToBase64(original.buffer);
            const decoded = atob(b64);
            const bytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
            expect(bytes).toEqual(original);
        });
    });

    describe('audioBufferToWav', () => {
        it('produces a valid WAV header for mono silence', () => {
            const samples = new Float32Array(100); // 100 samples of silence
            const ab = makeAudioBuffer([samples], 44100);
            const wav = audioBufferToWav(ab);
            const view = new DataView(wav);

            // RIFF header
            expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe('RIFF');
            // WAVE format
            expect(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))).toBe('WAVE');
            // fmt  chunk
            expect(String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15))).toBe('fmt ');
            // PCM format (1)
            expect(view.getUint16(20, true)).toBe(1);
            // Mono
            expect(view.getUint16(22, true)).toBe(1);
            // Sample rate
            expect(view.getUint32(24, true)).toBe(44100);
            // Bits per sample
            expect(view.getUint16(34, true)).toBe(16);
            // data chunk
            expect(String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39))).toBe('data');
        });

        it('has correct file size for mono', () => {
            const numSamples = 48;
            const samples = new Float32Array(numSamples);
            const ab = makeAudioBuffer([samples], 22050);
            const wav = audioBufferToWav(ab);

            // Total: 44-byte header + numSamples * 2 bytes
            expect(wav.byteLength).toBe(44 + numSamples * 2);

            const view = new DataView(wav);
            // RIFF file size = total - 8
            expect(view.getUint32(4, true)).toBe(wav.byteLength - 8);
            // data chunk size
            expect(view.getUint32(40, true)).toBe(numSamples * 2);
        });

        it('encodes stereo with correct interleaving and header', () => {
            const left = new Float32Array([0.5, -0.5]);
            const right = new Float32Array([0.25, -0.25]);
            const ab = makeAudioBuffer([left, right], 16000);
            const wav = audioBufferToWav(ab);
            const view = new DataView(wav);

            // Stereo (2 channels)
            expect(view.getUint16(22, true)).toBe(2);
            // Block align = 2 channels * 2 bytes = 4
            expect(view.getUint16(32, true)).toBe(4);
            // Data size: 2 samples * 2 channels * 2 bytes = 8
            expect(view.getUint32(40, true)).toBe(8);
            // Total size: 44 + 8
            expect(wav.byteLength).toBe(52);

            // Check interleaved sample order: L0, R0, L1, R1
            const s0 = view.getInt16(44, true); // left[0] = 0.5
            const s1 = view.getInt16(46, true); // right[0] = 0.25
            const s2 = view.getInt16(48, true); // left[1] = -0.5
            const s3 = view.getInt16(50, true); // right[1] = -0.25

            // 0.5 * 0x7FFF ≈ 16383
            expect(s0).toBe(Math.floor(0.5 * 0x7fff));
            // 0.25 * 0x7FFF ≈ 8191
            expect(s1).toBe(Math.floor(0.25 * 0x7fff));
            // -0.5 * 0x8000 = -16384
            expect(s2).toBe(Math.floor(-0.5 * 0x8000));
            // -0.25 * 0x8000 = -8192
            expect(s3).toBe(Math.floor(-0.25 * 0x8000));
        });

        it('clamps values outside [-1, 1]', () => {
            const samples = new Float32Array([2.0, -3.0]);
            const ab = makeAudioBuffer([samples], 8000);
            const wav = audioBufferToWav(ab);
            const view = new DataView(wav);

            // 2.0 clamped to 1.0 → 0x7FFF = 32767
            expect(view.getInt16(44, true)).toBe(0x7fff);
            // -3.0 clamped to -1.0 → -0x8000 = -32768
            expect(view.getInt16(46, true)).toBe(-0x8000);
        });

        it('silence produces all zero samples', () => {
            const samples = new Float32Array(4); // all zeros
            const ab = makeAudioBuffer([samples], 44100);
            const wav = audioBufferToWav(ab);
            const view = new DataView(wav);

            for (let i = 0; i < 4; i++) {
                expect(view.getInt16(44 + i * 2, true)).toBe(0);
            }
        });
    });
});
