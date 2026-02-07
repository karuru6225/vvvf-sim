import type { InverterParameters, PWMOutput } from './types';

export class PWMGenerator {
    // 定数
    private static readonly TWO_PI = 2 * Math.PI;

    /**
   * PWM出力を計算する
   * @param theta 基本波位相 (rad)
   * @param carrierTheta キャリア位相 (rad、非同期モード用)
   * @param params パラメータ
   */
    public generate(theta: number, carrierTheta: number, params: InverterParameters): PWMOutput {
        // 位相の正規化などは呼び出し元で行われている前提だが、念のため
        const normalizedTheta = theta % PWMGenerator.TWO_PI;

        // UVW各相の位相オフセット
        const uPhase = normalizedTheta;
        const vPhase = (normalizedTheta - (2 * Math.PI / 3) + PWMGenerator.TWO_PI) % PWMGenerator.TWO_PI;
        const wPhase = (normalizedTheta - (4 * Math.PI / 3) + PWMGenerator.TWO_PI) % PWMGenerator.TWO_PI;

        return {
            u: this.calculatePhaseVoltage(uPhase, carrierTheta, params),
            v: this.calculatePhaseVoltage(vPhase, carrierTheta, params),
            w: this.calculatePhaseVoltage(wPhase, carrierTheta, params),
            angle: normalizedTheta
        };
    }

    private calculatePhaseVoltage(phaseTheta: number, carrierTheta: number, params: InverterParameters): number {
        switch (params.pulseMode) {
            case 'Async':
                // 非同期: 独立したキャリア位相を使用
                return this.compareAsync(phaseTheta, carrierTheta, params);
            default:
                // 同期: 基本波位相からキャリア位相を算出
                return this.compareSync(phaseTheta, params);
        }
    }

    private compareAsync(phaseTheta: number, carrierTheta: number, params: InverterParameters): number {
        // 正弦波 (変調波)
        const sine = params.voltage * Math.sin(phaseTheta);

        // 三角波 (キャリア)
        // -1 ～ 1 の範囲で生成
        // carrierTheta は 0～2PI
        // 0～PI/2: -1 -> 1
        // PI/2～3PI/2: 1 -> -1
        // 3PI/2～2PI: -1 -> 1 (戻る)

        let tri = 0;
        const ct = carrierTheta % PWMGenerator.TWO_PI;

        if (ct < Math.PI) {
            // -1 から 1 へ (傾き 2/PI)
            // ct=0 -> -1
            // ct=PI -> 1 ... あれ？三角波の定義による
            // 一般的なPWMキャリアは二等辺三角形
            // 0 -> 1 -> 0 -> -1 -> 0 みたいなサイクルか、
            // -1 -> 1 -> -1 のサイクルか。
            // ここでは -1(0rad) -> 1(PI rad) -> -1(2PI rad) と仮定
            // 上昇: 0 ~ PI
            tri = -1 + (2 / Math.PI) * ct;
        } else {
            // 下降: PI ~ 2PI
            tri = 1 - (2 / Math.PI) * (ct - Math.PI);
        }

        // 比較
        return sine > tri ? 1 : -1;
    }

    private compareSync(phaseTheta: number, params: InverterParameters): number {
        // 同期モード
        // PulseMode からパルス数 N を取得 ( 'P3' -> 3 )
        let pulseCount = 1;
        if (params.pulseMode.startsWith('P')) {
            pulseCount = parseInt(params.pulseMode.substring(1));
        }

        // 同期モードのキャリア位相は基本波位相の N 倍
        // ただし、位相関係（同期点）を合わせる必要がある。
        // 通常は0クロスで同期させる。
        // N倍の周波数の三角波を生成

        // 1パルスモードなどの特殊系は別扱いが必要かもしれないが、
        // 基本的には N倍の三角波等比較でそれらしくなる
        if (pulseCount === 1) {
            // 1パルスは矩形波そのもの
            return Math.sin(phaseTheta) > 0 ? 1 : -1;
        }

        const carrierTheta = (phaseTheta * pulseCount) % PWMGenerator.TWO_PI;

        // 正弦波
        const sine = params.voltage * Math.sin(phaseTheta);

        // 三角波 (同期)
        // 同期モードの場合、極性を合わせるために位相シフトが必要な場合があるが、
        // 簡易的には非同期と同じロジックで N倍速のキャリアを使う

        // ここでは compareAsync と同じ三角波生成ロジックを流用できるが、
        // 呼び出しを変える必要があるため、コードを再利用する形にするか、ここで書くか。
        // 同期モードの場合、キャリアの位相は phaseTheta * pulseCount
        // ただし、3パルスなどは、正弦波の山頂(PI/2)でキャリアの谷が来る、あるいは山が来るなどの関係性がある。
        // 正弦波(sin)と三角波の位相関係: sin(0)=0。三角波も0スタートでよいか？
        // 通常のSPWMでは、三角波は -1 スタートではなく 0クロススタートが良い場合もあるが、
        // ひとまず Async と同じ -1 スタートで試す。
        // 3パルス: 0〜PIの間に山が3つ？いや、パルスが3つ。

        // 動作検証しながら調整するとして、まずはAsyncと同じ三角波ロジックを展開
        let tri = 0;
        // 3パルスで、正の半周(0-PI)にパルス3つ出すには、キャリアは3倍速？
        // キャリア1周期でパルス1つ生成されるなら、3倍速なら3つ詳細。

        // carrierThetaの計算における位相補正
        // 通常、同期PWMでは「正弦波の0クロス」と「三角波の0クロス（またはピーク）」を合わせる
        // 3パルスモードの場合、位相0でパルス開始（立ち上がり）を見るなら、三角波は負のピーク(-1)であるべき。
        // 上記のAsyncロジックは 0rad で -1 なので、合致している。

        // 偶数パルスや3の倍数パルスでのdipolar変調などの詳細はあるが、まずは単純比較で実装。

        const ct = carrierTheta;

        if (ct < Math.PI) {
            tri = -1 + (2 / Math.PI) * ct;
        } else {
            tri = 1 - (2 / Math.PI) * (ct - Math.PI);
        }

        return sine > tri ? 1 : -1;
    }
}

