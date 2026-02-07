
import type { PulseMode } from './types';

export interface PatternResult {
    voltage: number;
    carrierFreq: number;
    pulseMode: PulseMode;
}

export interface VVVFPattern {
    name: string;
    description: string;
    calculate: (freq: number) => PatternResult;
}

// 1. Standard IGBT (E233-like)
// High constant carrier, wide async region
const StandardIGBT: VVVFPattern = {
    name: "Standard IGBT",
    description: "Typical modern commuter train (E233 style). High carrier frequency.",
    calculate: (f) => {
        let voltage = Math.min((f / 60) * 1.0, 1.0);
        if (f > 60) voltage = 1.0 + (f - 60) * 0.005;

        let carrier = 1500;
        let mode: PulseMode = 'Async';

        if (f < 10) { carrier = 1500; }
        else if (f < 40) { carrier = 1500; } // Keep high
        else if (f < 48) { mode = 'P7'; } // Asynchronous until ~40Hz? Actually E233 switches mode earlier or later depending on config. Let's simplify.
        else if (f < 56) { mode = 'P5'; }
        else if (f < 64) { mode = 'P3'; }
        else { mode = 'P1'; }

        return { voltage, carrierFreq: carrier, pulseMode: mode };
    }
};

// 2. Singing GTO (Keikyu Siemens)
// Pitch increases in steps
const SingingGTO: VVVFPattern = {
    name: "Singing GTO (Siemens)",
    description: "Famous 'Do-Re-Mi' scale startup sound.",
    calculate: (f) => {
        // Voltage ramp
        let voltage = Math.min((f / 50) * 1.0, 1.0);
        if (f > 50) voltage = 1.0;

        let carrier = 800;
        let mode: PulseMode = 'Async';

        // Scale logic (Approximate)
        if (f < 2) { carrier = 300; } // Low start
        else if (f < 4) { carrier = 329.63; } // E
        else if (f < 6) { carrier = 370; }    // F# / Gb (Actually typical Siemens is slightly different steps but this gives the feeling)
        else if (f < 7.5) { carrier = 392; }  // G
        else if (f < 9) { carrier = 440; }    // A
        else if (f < 10.5) { carrier = 493.88; } // B
        else if (f < 12) { carrier = 523.25; } // C
        else if (f < 14) { carrier = 587.33; } // D
        else if (f < 16) { carrier = 659.25; } // E
        else {
            // After singing, move to constant or sync
            if (f < 25) { carrier = 700; }
            else if (f < 35) { mode = 'P7'; }
            else if (f < 45) { mode = 'P5'; }
            else if (f < 55) { mode = 'P3'; }
            else { mode = 'P1'; }
        }

        return { voltage, carrierFreq: carrier, pulseMode: mode };
    }
};

// 3. Early GTO (209 style)
// Lower carrier, noisy
const EarlyGTO: VVVFPattern = {
    name: "Early GTO",
    description: "90s style GTO thyristor. Lower, distinct carrier sound.",
    calculate: (f) => {
        let voltage = Math.min((f / 55) * 1.0, 1.0);

        let carrier = 400; // Low carrier
        let mode: PulseMode = 'Async';

        if (f < 15) { carrier = 400; }
        else if (f < 25) { carrier = 600; } // Carrier change
        else if (f < 32) { mode = 'P7'; }
        else if (f < 40) { mode = 'P5'; }
        else if (f < 50) { mode = 'P3'; }
        else { mode = 'P1'; }

        return { voltage, carrierFreq: carrier, pulseMode: mode };
    }
};

const ToshibaGTO_207: VVVFPattern = {
    name: "Toshiba GTO (207-1000)",
    description: "Used in JR West 207-1000 series. Distinctive high-pitched asynchronous whir.",
    calculate: (f) => {
        // Voltage
        let voltage = Math.min((f / 60) * 1.0, 1.0);
        if (f > 60) voltage = 1.0;

        let carrier = 365; // Initial carrier
        let mode: PulseMode = 'Async';

        // Frequency ranges based on typical Toshiba GTO behavior
        // Async: Start around 365Hz, slightly varying or constant?
        // Let's assume constant 1050Hz for async based on some sources, or slightly decreasing.
        // Sync modes: P7 -> P5 -> P3 -> P1
        if (f < 12.5) { carrier = 365; mode = 'Async'; }
        else if (f < 30) { mode = 'P15'; } // 45-58Hz
        else if (f < 43) { mode = 'P9'; } // 58-70Hz
        else if (f < 53) { mode = 'P5'; } // 70-85Hz
        else if (f < 60) { mode = 'P3'; } // 70-85Hz
        else { mode = 'P1'; }             // 85Hz+

        return { voltage, carrierFreq: carrier, pulseMode: mode };
    }
};

export const Patterns = [StandardIGBT, SingingGTO, EarlyGTO, ToshibaGTO_207];
