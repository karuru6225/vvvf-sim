
export interface InverterParameters {
  // 基本パラメータ
  freq: number;       // インバータ周波数 (Hz)
  voltage: number;    // インバータ電圧 (0.0 - 1.0)
  phase: number;      // 位相 (rad)

  // PWM設定
  carrierFreq: number; // キャリア周波数 (Hz)
  pulseMode: PulseMode; // パルスモード
}

export type PulseMode = 
  | 'Async' 
  | 'P1'    // 1パルス
  | 'P3'    // 3パルス
  | 'P5'    // 5パルス
  | 'P7'    // 7パルス
  | 'P9'    // 9パルス
  | 'P11'   // 11パルス
  | 'P13'   // 13パルス
  | 'P15'   // 15パルス
  | 'P27'   // 27パルス
  | 'P45'   // 45パルス
  | 'CHM';  // Current Harmonic Minimum (電流高調波最小)

export interface PWMOutput {
  u: number; // U相電圧 (-1, 0, 1)
  v: number; // V相電圧 (-1, 0, 1)
  w: number; // W相電圧 (-1, 0, 1)
  angle: number; // 現在の位相角
}
