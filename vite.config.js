import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile()
  ],
  server: {
    port: 3000,
    open: true
  },
  build: {
    rollupOptions: {
      output: {
        // 禁用代码分割，将所有内容打包到单个文件中
        manualChunks: undefined,
        // 内联所有模块到一个文件中
        inlineDynamicImports: true,
      },
    },
    // 禁用CSS代码分割
    cssCodeSplit: false,
    // 设置chunk大小警告限制
    chunkSizeWarningLimit: 1000,
    // 生成资源的内联阈值
    assetsInlineLimit: 100000000, // 100MB，确保所有资源都被内联
  },
})
