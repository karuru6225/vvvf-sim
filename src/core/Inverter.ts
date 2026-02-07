import type { InverterParameters, PWMOutput } from './types';
import { PWMGenerator } from './PWMGenerator';

export class Inverter {
    // 状態
    private params: InverterParameters;
    private pwmGenerator: PWMGenerator;

    // 内部状態
    private time: number = 0;
    private theta: number = 0; // 基本波位相 (rad)
    private carrierTheta: number = 0; // キャリア位相 (rad) - 非同期モード用

    constructor(initialParams: InverterParameters) {
        this.params = { ...initialParams };
        this.pwmGenerator = new PWMGenerator();
    }

    public update(dt: number): void {
        this.time += dt;

        // 基本波位相の更新
        // theta += 2 * pi * f * dt
        const twoPi = 2 * Math.PI;
        this.theta += twoPi * this.params.freq * dt;
        this.theta %= twoPi;

        // キャリア位相の更新 (非同期モード用)
        // carrierTheta += 2 * pi * fc * dt
        this.carrierTheta += twoPi * this.params.carrierFreq * dt;
        this.carrierTheta %= twoPi;
    }

    public getOutput(): PWMOutput {
        return this.pwmGenerator.generate(this.theta, this.carrierTheta, this.params);
    }

    public getTargetOutput(): { u: number, v: number, w: number } {
        // 3相の目標波形 (変調波)
        const twoPi = 2 * Math.PI;
        // u = sin(theta)
        // v = sin(theta - 2pi/3)
        // w = sin(theta + 2pi/3)
        const vParams = this.params.voltage;

        return {
            u: vParams * Math.sin(this.theta),
            v: vParams * Math.sin(this.theta - twoPi / 3),
            w: vParams * Math.sin(this.theta + twoPi / 3)
        };
    }

    public setParams(newParams: Partial<InverterParameters>): void {
        this.params = { ...this.params, ...newParams };
    }

    public getParams(): InverterParameters {
        return { ...this.params };
    }

    public getState(): { theta: number, carrierTheta: number } {
        return {
            theta: this.theta,
            carrierTheta: this.carrierTheta
        };
    }
}
