import { useRef, useState } from 'react'
import { WaveformDisplay } from './components/WaveformDisplay'
import { ControlPanel } from './components/ControlPanel'
import { Inverter } from './core/Inverter'
import type { InverterParameters } from './core/types'
import './App.css'

const INITIAL_PARAMS: InverterParameters = {
  freq: 0,
  voltage: 0,
  phase: 0,
  carrierFreq: 1000,
  pulseMode: 'Async'
};

function App() {
  // Inverterインスタンスは再レンダリングで作り直さないよう useRef で保持
  // (シングルトンでも良いが、Reactのライフサイクルに合わせる)
  const inverterRef = useRef(new Inverter(INITIAL_PARAMS));
  const [timeScale, setTimeScale] = useState(1.0);

  // フィルタ状態をここで管理し、ControlPanelとWaveformDisplayに共有
  const [filterEnabled, setFilterEnabled] = useState(true);
  const [filterFreq, setFilterFreq] = useState(2000);

  // 表示倍率 (横軸縮尺)
  const [zoomLevel, setZoomLevel] = useState(5); // Default 5x (widened view)

  return (
    <>
      <div className="card">
        <h1>VVVF Simulator</h1>
        <WaveformDisplay
          inverter={inverterRef.current}
          timeScale={timeScale}
          filterEnabled={filterEnabled}
          filterFreq={filterFreq}
          zoomLevel={zoomLevel}
        />
        <ControlPanel
          inverter={inverterRef.current}
          timeScale={timeScale}
          setTimeScale={setTimeScale}
          filterEnabled={filterEnabled}
          setFilterEnabled={setFilterEnabled}
          filterFreq={filterFreq}
          setFilterFreq={setFilterFreq}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
        />
      </div>
    </>
  )
}

export default App

