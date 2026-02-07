# VVVF シミュレーター

Web Audio API を使用した、ブラウザ上で動作する VVVF (可変電圧可変周波数) インバータ音のシミュレーターです。
React + TypeScript + Vite で構築されています。

## 公開ページ

GitHub Pages で公開されています:
https://karuru6225.github.io/vvvf-sim/

## 機能

- **リアルタイム音声生成**: AudioWorklet を使用して、PWM波形をリアルタイムに生成します。
- **波形表示**: 出力される波形を視覚的に確認できます。
- **パラメータ調整**: キャリア周波数や変調方式などを調整可能です。

## 開発環境のセットアップ

1.  依存関係のインストール:
    ```bash
    npm install
    ```

2.  開発サーバーの起動:
    ```bash
    npm run dev
    ```

## デプロイ

このプロジェクトは GitHub Actions を使用して自動デプロイされるように設定されています。
`main` ブランチにプッシュすると、自動的にビルドされ `gh-pages` ブランチにデプロイされます。

## 技術スタック

-   React
-   TypeScript
-   Vite
-   Web Audio API (AudioWorklet)
