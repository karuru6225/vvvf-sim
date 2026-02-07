import type { InverterParameters } from '../core/types';
import pwmProcessorUrl from './pwm-processor.worklet.ts?worker&url';

export class AudioController {
    private context: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private isInitialized = false;

    public async init(): Promise<void> {
        if (this.isInitialized) return;

        this.context = new AudioContext();

        if (!this.context.audioWorklet) {
            const message = 'AudioWorklet is not supported in this context. ' +
                'Please use "localhost" or HTTPS to access this application. ' +
                '(Accessing via IP address over HTTP is often insecure and disables AudioWorklet)';
            alert(message);
            throw new Error(message);
        }

        try {
            // Workletモジュールの読み込み
            // Viteの場合、?worker&url でURLを取得して addModule する
            await this.context.audioWorklet.addModule(pwmProcessorUrl);

            this.workletNode = new AudioWorkletNode(this.context, 'pwm-processor', {
                outputChannelCount: [2] // ステレオ出力
            });

            this.workletNode.connect(this.context.destination);
            this.isInitialized = true;

            this.workletNode.onprocessorerror = (e) => {
                console.error('AudioWorklet Processor Error:', e);
            };

            // 初期状態はsuspendかもしれないのでresume
            if (this.context.state === 'suspended') {
                await this.context.resume();
            }

        } catch (e) {
            console.error('Failed to initialize AudioWorklet:', e);
            alert(`Audio initialization failed: ${e instanceof Error ? e.message : String(e)}`);
            throw e;
        }
    }

    public updateParams(params: Partial<InverterParameters>): void {
        if (!this.workletNode) return;

        // Workletにメッセージを送る
        this.workletNode.port.postMessage({
            type: 'updateParams',
            payload: params
        });
    }

    public setFilter(enabled: boolean, cutoff: number = 2000): void {
        if (!this.workletNode) return;
        this.workletNode.port.postMessage({
            type: 'setFilter',
            payload: { enabled, cutoff }
        });
    }

    public async resume(): Promise<void> {
        if (this.context && this.context.state === 'suspended') {
            await this.context.resume();
        }
    }

    public async suspend(): Promise<void> {
        if (this.context && this.context.state === 'running') {
            await this.context.suspend();
        }
    }
}

// シングルトンインスタンス
export const audioController = new AudioController();
