import { Inverter } from '../core/Inverter';
import type { InverterParameters } from '../core/types';

class PWMProcessor extends AudioWorkletProcessor {
    private inverter: Inverter;

    private filterEnabled: boolean = false;
    private lpfU = new BiquadFilter();
    private lpfV = new BiquadFilter();
    private lpfW = new BiquadFilter();

    constructor() {
        super();
        // 初期パラメータ
        const initialParams: InverterParameters = {
            freq: 0,
            voltage: 0,
            phase: 0,
            carrierFreq: 1000,
            pulseMode: 'Async'
        };
        this.inverter = new Inverter(initialParams);

        // Configure Filters (LPF)
        // Default to 2000Hz to avoid muting carrier freq
        this.lpfU.setParams(sampleRate, 2000, 0.707);
        this.lpfV.setParams(sampleRate, 2000, 0.707);
        this.lpfW.setParams(sampleRate, 2000, 0.707);

        // メッセージハンドリング
        this.port.onmessage = (event) => {
            // パラメータ更新
            if (event.data.type === 'updateParams') {
                const params = event.data.payload as Partial<InverterParameters>;
                this.inverter.setParams(params);
            } else if (event.data.type === 'setFilter') {
                const payload = event.data.payload as { enabled: boolean, cutoff: number };
                this.filterEnabled = payload.enabled;
                const cutoff = payload.cutoff || 2000;

                // Update Filter Coeffs
                this.lpfU.setParams(sampleRate, cutoff, 0.707);
                this.lpfV.setParams(sampleRate, cutoff, 0.707);
                this.lpfW.setParams(sampleRate, cutoff, 0.707);
            }
        };
    }

    process(_inputs: Float32Array[][], outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
        // ... (existing process logic, no change needed if Biquad updates properly)
        const output = outputs[0];
        const channelL = output[0];
        const channelR = output[1];

        const dt = 1 / sampleRate;

        for (let i = 0; i < channelL.length; i++) {
            this.inverter.update(dt);
            const vals = this.inverter.getOutput();

            let u = vals.u;
            let v = vals.v;
            let w = vals.w;

            if (this.filterEnabled) {
                u = this.lpfU.process(u);
                v = this.lpfV.process(v);
                w = this.lpfW.process(w);
            }


            const uv = u - v;
            const vw = v - w;

            // 出力ゲイン調整
            const gain = 0.1;

            channelL[i] = uv * gain;
            if (channelR) {
                channelR[i] = vw * gain;
            }
        }

        return true; // プロセス継続
    }
}

class BiquadFilter {
    // Direct Form II Transposed implementation or similar for stability
    // y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]

    // Coeffs
    b0 = 0; b1 = 0; b2 = 0; a1 = 0; a2 = 0;

    // State
    x1 = 0; x2 = 0; y1 = 0; y2 = 0;

    setParams(sampleRate: number, cutoff: number, q: number) {
        // Low Pass Filter design
        const w0 = 2 * Math.PI * cutoff / sampleRate;
        const alpha = Math.sin(w0) / (2 * q);
        const cosw0 = Math.cos(w0);

        const a0 = 1 + alpha;
        this.b0 = ((1 - cosw0) / 2) / a0;
        this.b1 = (1 - cosw0) / a0;
        this.b2 = ((1 - cosw0) / 2) / a0;
        this.a1 = (-2 * cosw0) / a0;
        this.a2 = (1 - alpha) / a0;
    }

    process(inVal: number): number {
        const outVal = this.b0 * inVal + this.b1 * this.x1 + this.b2 * this.x2
            - this.a1 * this.y1 - this.a2 * this.y2;

        this.x2 = this.x1;
        this.x1 = inVal;
        this.y2 = this.y1;
        this.y1 = outVal;

        return outVal;
    }
}

registerProcessor('pwm-processor', PWMProcessor);
