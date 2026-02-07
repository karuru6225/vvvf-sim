
import React, { useState } from 'react';
import { Inverter } from '../core/Inverter';
import type { InverterParameters } from '../core/types';
import { audioController } from '../audio/AudioController';
import { Patterns } from '../core/VVVFPattern';

interface UserControlPanelProps {
    inverter: Inverter;
    timeScale: number;
    setTimeScale: (scale: number) => void;
    filterEnabled: boolean;
    setFilterEnabled: (enabled: boolean) => void;
    filterFreq: number;
    setFilterFreq: (freq: number) => void;
    zoomLevel: number;
    setZoomLevel: (zoom: number) => void;
}

export const ControlPanel: React.FC<UserControlPanelProps> = ({
    inverter,
    timeScale,
    setTimeScale,
    filterEnabled,
    setFilterEnabled,
    filterFreq,
    setFilterFreq,
    zoomLevel,
    setZoomLevel
}) => {
    // 表示用の状態
    const [params, setParams] = useState<InverterParameters>(inverter.getParams());
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [isAuto, setIsAuto] = useState(false);
    const [selectedPatternIndex, setSelectedPatternIndex] = useState(0);

    // Initial sync
    React.useEffect(() => {
        audioController.setFilter(filterEnabled, filterFreq);
    }, []);

    const toggleFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
        const enabled = e.target.checked;
        setFilterEnabled(enabled);
        audioController.setFilter(enabled, filterFreq);
    };

    const handleFilterFreqChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const freq = parseFloat(e.target.value);
        setFilterFreq(freq);
        audioController.setFilter(filterEnabled, freq);
    };

    // Auto Control Handler
    const handleAutoChange = (newFreq: number) => {
        const pattern = Patterns[selectedPatternIndex];
        const result = pattern.calculate(newFreq);

        const newParams = {
            ...params,
            freq: newFreq,
            voltage: result.voltage,
            carrierFreq: result.carrierFreq,
            pulseMode: result.pulseMode
        };

        setParams(newParams);
        inverter.setParams(newParams);
        audioController.updateParams(newParams);
    };

    const handleChange = (key: keyof InverterParameters, value: number | string) => {
        // ... (existing)

        const newParams = { ...params, [key]: value };
        setParams(newParams);
        inverter.setParams({ [key]: value });
        audioController.updateParams({ [key]: value });
    };

    const handleAudioToggle = async () => {
        try {
            if (!audioEnabled) {
                await audioController.init();
                await audioController.resume();
                // 現在のパラメータを送信
                audioController.updateParams(params);
                setAudioEnabled(true);
            } else {
                await audioController.suspend();
                setAudioEnabled(false);
            }
        } catch (e) {
            console.error('Audio toggle failed:', e);
        }
    };

    return (
        <div className="control-panel" style={{ padding: '20px', backgroundColor: '#333', color: '#fff', marginTop: '20px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ margin: 0 }}>Control Panel</h2>
                <button
                    onClick={handleAudioToggle}
                    style={{
                        padding: '10px 20px',
                        fontSize: '1em',
                        backgroundColor: audioEnabled ? '#dd4444' : '#44aa44',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                    }}
                >
                    {audioEnabled ? 'Stop Audio' : 'Start Audio'}
                </button>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <input
                            type="checkbox"
                            checked={filterEnabled}
                            onChange={toggleFilter}
                            style={{ marginRight: '5px' }}
                        />
                        Enable LPF
                    </label>
                    {filterEnabled && (
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
                            <span style={{ fontSize: '0.8em', marginRight: '5px' }}>Cutoff: {filterFreq}Hz</span>
                            <input
                                type="range"
                                min="100"
                                max="5000"
                                step="100"
                                value={filterFreq}
                                onChange={handleFilterFreqChange}
                                style={{ width: '100px' }}
                            />
                        </div>
                    )}
                </div>
            </div>


            <div className="control-group" style={{
                borderBottom: '2px solid #555',
                paddingBottom: '20px',
                marginBottom: '20px',
                backgroundColor: '#444',
                padding: '15px',
                borderRadius: '5px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '1.2em' }}>
                        <input
                            type="checkbox"
                            checked={isAuto}
                            onChange={(e) => setIsAuto(e.target.checked)}
                            style={{ marginRight: '10px' }}
                        />
                        Auto Control (Pattern)
                    </label>
                    <select
                        value={selectedPatternIndex}
                        onChange={(e) => setSelectedPatternIndex(parseInt(e.target.value))}
                        disabled={!isAuto}
                        style={{ padding: '5px', borderRadius: '4px', backgroundColor: '#333', color: '#fff', border: '1px solid #777' }}
                    >
                        {Patterns.map((p, i) => (
                            <option key={i} value={i}>{p.name}</option>
                        ))}
                    </select>
                </div>

                {isAuto && (
                    <div style={{ marginTop: '10px' }}>
                        <div style={{ marginBottom: '10px', fontSize: '0.9em', color: '#ccc', fontStyle: 'italic' }}>
                            {Patterns[selectedPatternIndex].description}
                        </div>
                        <label>Target Speed / Frequency: {params.freq.toFixed(1)} Hz</label>
                        <input
                            type="range"
                            min="0"
                            max="120"
                            step="0.1"
                            value={params.freq}
                            onChange={(e) => handleAutoChange(parseFloat(e.target.value))}
                            style={{ width: '100%', height: '30px' }}
                        />
                        <div style={{ fontSize: '0.9em', color: '#aaa', marginTop: '5px' }}>
                            Automatically adjusts Voltage, Carrier, and Pulse Mode based on Frequency.
                        </div>
                    </div>
                )}
            </div>

            <div className="control-group" style={{ opacity: isAuto ? 0.5 : 1.0, pointerEvents: isAuto ? 'none' : 'auto' }}>
                <label>Frequency (Hz): {params.freq.toFixed(2)}</label>
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={params.freq}
                    onChange={(e) => handleChange('freq', parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                />
            </div>

            <div className="control-group">
                <label>Voltage Rate (0.0-1.0): {params.voltage.toFixed(2)}</label>
                <input
                    type="range"
                    min="0"
                    max="2.0" // 過変調も許容
                    step="0.01"
                    value={params.voltage}
                    onChange={(e) => handleChange('voltage', parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                />
            </div>

            <div className="control-group">
                <label>Carrier Frequency (Hz): {params.carrierFreq}</label>
                <input
                    type="range"
                    min="100"
                    max="5000"
                    step="100"
                    value={params.carrierFreq}
                    onChange={(e) => handleChange('carrierFreq', parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                />
            </div>

            <div className="control-group">
                <label>Pulse Mode: {params.pulseMode}</label>
                <select
                    value={params.pulseMode}
                    onChange={(e) => handleChange('pulseMode', e.target.value)}
                    style={{ marginLeft: '10px', padding: '5px' }}
                >
                    <option value="Async">Async</option>
                    <option value="P1">1-Pulse</option>
                    <option value="P3">3-Pulse</option>
                    <option value="P5">5-Pulse</option>
                    <option value="P7">7-Pulse</option>
                    {/* 他のモードは必要に応じて追加 */}
                </select>
            </div>

            <div className="control-group" style={{ borderBottom: '1px solid #555', paddingBottom: '15px', marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <label>Time Scale (Speed)</label>
                    <input
                        type="number"
                        min="0"
                        step="0.00001"
                        value={timeScale}
                        onChange={(e) => setTimeScale(parseFloat(e.target.value))}
                        style={{ width: '80px', padding: '2px' }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => setTimeScale(0)} style={{ padding: '5px 10px', backgroundColor: '#555', border: 'none', color: '#fff', cursor: 'pointer' }}>Pause</button>
                    <button onClick={() => setTimeScale(0.1)} style={{ padding: '5px 10px', backgroundColor: '#555', border: 'none', color: '#fff', cursor: 'pointer' }}>Slow</button>
                    <button onClick={() => setTimeScale(1.0)} style={{ padding: '5px 10px', backgroundColor: '#555', border: 'none', color: '#fff', cursor: 'pointer' }}>Normal</button>
                    <input
                        type="range"
                        min="0"
                        max="2.0"
                        step="0.01"
                        value={timeScale}
                        onChange={(e) => setTimeScale(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
                    />
                </div>
            </div>

            <div className="control-group" style={{ borderBottom: '1px solid #555', paddingBottom: '15px', marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <label>Horizontal Zoom (History Length): {zoomLevel}x</label>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={zoomLevel}
                        onChange={(e) => setZoomLevel(parseInt(e.target.value))}
                        style={{ width: '60%' }}
                    />
                </div>
                <div style={{ fontSize: '0.8em', color: '#aaa', textAlign: 'right' }}>
                    Window: {(zoomLevel * 500 * 0.05).toFixed(1)} ms
                </div>
            </div>

            <style>{`
        .control-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
        }
      `}</style>
        </div >
    );
};
