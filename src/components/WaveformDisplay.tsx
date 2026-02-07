import { useEffect, useRef } from 'react';
import { Inverter } from '../core/Inverter';
import { PWMGenerator } from '../core/PWMGenerator';


// 簡易フィルタクラス (AudioWorkletとロジックを合わせる)
class BiquadFilter {
    // Coeffs
    b0 = 0; b1 = 0; b2 = 0; a1 = 0; a2 = 0;
    // State
    x1 = 0; x2 = 0; y1 = 0; y2 = 0;

    setParams(sampleRate: number, cutoff: number, q: number) {
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

interface WaveformDisplayProps {
    inverter: Inverter;
    timeScale: number;
    filterEnabled: boolean;
    filterFreq: number;
    zoomLevel: number;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({ inverter, timeScale, filterEnabled, filterFreq, zoomLevel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const timeScaleRef = useRef(timeScale);
    const filterParamsRef = useRef({ enabled: filterEnabled, freq: filterFreq });
    const zoomLevelRef = useRef(zoomLevel);

    // フィルタインスタンス (Render内で使用、Pre-rollで整定させるためRef保持不要だが、メモリ確保コスト削減で使い回す)
    const lpfU = useRef(new BiquadFilter());
    const lpfV = useRef(new BiquadFilter());
    const lpfW = useRef(new BiquadFilter());

    // 予測描画用のPWMGenerator
    const generatorRef = useRef(new PWMGenerator());

    useEffect(() => {
        timeScaleRef.current = timeScale;
    }, [timeScale]);

    useEffect(() => {
        filterParamsRef.current = { enabled: filterEnabled, freq: filterFreq };
        // LPFの係数設定はRender Loop内で行う（SampleRateが可変になる可能性があるため、あるいは固定ステップでやるならここでも良い）
        // 今回はRender内で固定ステップシミュレーションを行う
    }, [filterEnabled, filterFreq]);

    useEffect(() => {
        zoomLevelRef.current = zoomLevel;
    }, [zoomLevel]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        const FIXED_STEP = 0.00005; // 50us
        const generator = generatorRef.current;

        const render = () => {
            // 1. パラメータと状態の取得
            const params = inverter.getParams();
            const state = inverter.getState();
            const { enabled, freq: lpfFreq } = filterParamsRef.current;
            const currentZoom = zoomLevelRef.current;

            // 2. 描画時間幅の決定
            // Zoom=1 -> 25ms, Zoom=20 -> 500ms
            const viewDuration = currentZoom * 0.025; // 25ms * zoom

            // 3. 位相同期 (Phase Lock) のための初期状態計算
            // 左端(t=0)で theta = 0 となるようにする。
            // しかし、非同期キャリアの「基本波に対する相対位相」は維持したい。
            // 現在の実状態: theta_now, carrier_now
            // 仮想のt=0での状態: theta_start = 0
            // 時間差 dt = - theta_now / (2 * PI * f)
            // carrier_start = carrier_now + (2 * PI * fc * dt)

            let startCarrierTheta = 0;
            if (params.freq > 0.1) {
                // 基本波周期に基づいたオフセット
                // thetaが 0 ~ 2PI のどこにいるか
                // 戻るべき時間量 (正の値にするため一工夫)
                const phaseDiff = state.theta; // 0まで戻る量
                const timeToBack = phaseDiff / (2 * Math.PI * params.freq);

                // キャリア位相の補正
                const carrierFreq = params.carrierFreq;
                startCarrierTheta = state.carrierTheta - (2 * Math.PI * carrierFreq * timeToBack);
            } else {
                // 低周波すぎて同期できない場合はそのまま流す(あるいは時間でスクロール)
                // ここでは単純に現在のキャリア位相を使う
                startCarrierTheta = state.carrierTheta;
            }

            // 4. LPFのセットアップ (係数更新)
            const sampleRate = 1 / FIXED_STEP;
            const uFilter = lpfU.current;
            const vFilter = lpfV.current;
            const wFilter = lpfW.current;
            if (enabled) {
                uFilter.setParams(sampleRate, lpfFreq, 0.707);
                vFilter.setParams(sampleRate, lpfFreq, 0.707);
                wFilter.setParams(sampleRate, lpfFreq, 0.707);
            }

            // Pre-roll (LPFの過渡応答を消すために、少し前からシミュレーションする)
            // 5ms分くらい空回し
            const preRollSteps = 100; // 5ms @ 50us

            // データ格納用配列
            const totalSteps = Math.ceil(viewDuration / FIXED_STEP);
            // キャンバス解像度に合わせてダウンサンプリングして描画点数を抑える
            // ここでは簡易的に全点保持し、描画時に間引くか、Canvas Pathに任せる
            // 配列再確保を避けるため、固定長バッファを使い回すのが良いが、簡略化のため毎回確保(JSエンジンに任せる)
            const uData: number[] = [];
            const vData: number[] = [];
            const wData: number[] = [];
            const tUData: number[] = [];
            const tVData: number[] = [];
            const tWData: number[] = [];

            // シミュレーションループ
            // t < 0 (Pre-roll) -> t >= 0 (Recording)

            let currentTheta = 0; // t=0で0
            if (params.freq <= 0.1) currentTheta = state.theta; // 停止時はそのまま

            let currentCarrier = startCarrierTheta;
            let currentT = - (preRollSteps * FIXED_STEP);

            const twoPiFreq = 2 * Math.PI * params.freq;
            const twoPiCarrier = 2 * Math.PI * params.carrierFreq;

            // Pre-roll start phase adjustment
            currentTheta += twoPiFreq * currentT;
            currentCarrier += twoPiCarrier * currentT;

            const totalSimSteps = preRollSteps + totalSteps;

            for (let i = 0; i < totalSimSteps; i++) {
                // Generate
                const out = generator.generate(currentTheta, currentCarrier, params);

                let u = out.u;
                let v = out.v;
                let w = out.w;

                // LPF
                if (enabled) {
                    u = uFilter.process(u);
                    v = vFilter.process(v);
                    w = wFilter.process(w);
                }

                // Record only if not pre-roll
                if (i >= preRollSteps) {
                    uData.push(u);
                    vData.push(v);
                    wData.push(w);

                    // Targets
                    const voltage = params.voltage;
                    tUData.push(voltage * Math.sin(currentTheta));
                    tVData.push(voltage * Math.sin(currentTheta - 2 * Math.PI / 3));
                    tWData.push(voltage * Math.sin(currentTheta + 2 * Math.PI / 3));
                }

                // Advance
                currentTheta += twoPiFreq * FIXED_STEP;
                currentCarrier += twoPiCarrier * FIXED_STEP;
                currentT += FIXED_STEP;
            }

            // 描画
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#1e1e1e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const drawWave = (data: number[], color: string, offsetY: number, scaleY: number, lineDash: number[] = []) => {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.setLineDash(lineDash);

                const len = data.length;
                const stepX = canvas.width / len;

                if (len > 0) {
                    ctx.moveTo(0, offsetY - (data[0] * scaleY));
                    for (let i = 1; i < len; i++) {
                        ctx.lineTo(i * stepX, offsetY - (data[i] * scaleY));
                    }
                }
                ctx.stroke();
                ctx.setLineDash([]);
            };

            const quarterHeight = canvas.height / 4;
            const scale = 40;

            drawWave(tUData, '#ffff00', quarterHeight * 1, scale, [5, 5]);
            drawWave(uData, '#ff5555', quarterHeight * 1, scale);

            drawWave(tVData, '#ffff00', quarterHeight * 2, scale, [5, 5]);
            drawWave(vData, '#55ff55', quarterHeight * 2, scale);

            drawWave(tWData, '#ffff00', quarterHeight * 3, scale, [5, 5]);
            drawWave(wData, '#5555ff', quarterHeight * 3, scale);

            animationId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, []); // 依存配列は空でよい (Refで値を取得するため)

    return (
        <div style={{ width: '100%', backgroundColor: '#000', borderRadius: '4px', overflow: 'hidden' }}>
            <canvas
                ref={canvasRef}
                width={800}
                height={400}
                style={{ width: '100%', height: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', padding: '10px', color: '#fff', fontSize: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '15px', height: '15px', backgroundColor: '#ff5555', borderRadius: '3px' }}></div>
                    <span>U-Phase</span>
                </div>
                {/* Legend continues... */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '15px', height: '15px', backgroundColor: '#55ff55', borderRadius: '3px' }}></div>
                    <span>V-Phase</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '15px', height: '15px', backgroundColor: '#5555ff', borderRadius: '3px' }}></div>
                    <span>W-Phase</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '15px', height: '15px', backgroundColor: '#ffff00', borderRadius: '3px', border: '1px dashed #fff' }}></div>
                    <span>Target Sine</span>
                </div>
            </div>
        </div>
    );
};
