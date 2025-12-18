import { useEffect, useState } from "react"

import { MESSAGE_TYPES } from "../lib/constants"
import type { NcSettings } from "../lib/types"

export default function OptionsPage() {
  const [settings, setSettings] = useState<NcSettings>()

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: MESSAGE_TYPES.requestState })
      .then((response) => {
        if (response?.ok) {
          setSettings(response.data.settings as NcSettings)
        }
      })
  }, [])

  return (
    <main style={containerStyle}>
      <h1>NiconiCompare Options</h1>
      <section>
        <h2>現在の設定</h2>
        {settings ? (
          <dl>
            <dt>比較候補数</dt>
            <dd>{settings.recentWindowSize} 件</dd>
            <dt>オーバーレイ</dt>
            <dd>{settings.overlayEnabled ? "ON" : "OFF"}</dd>
            <dt>自動閉鎖</dt>
            <dd>{settings.overlayAutoCloseMs / 1000}s</dd>
          </dl>
        ) : (
          <p>読込中...</p>
        )}
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          詳細な設定 UI は今後追加予定です。暫定的に状態のみ表示しています。
        </p>
      </section>
    </main>
  )
}

const containerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: 32,
  fontFamily: "system-ui, sans-serif"
}
