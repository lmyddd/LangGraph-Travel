import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'
import viteCompression from 'vite-plugin-compression'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [VantResolver()],
    }),
    // Gzip 压缩：预生成 .gz 文件，Nginx 可直接返回，省去实时压缩 CPU 开销
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,        // 小于 1KB 的文件不压
      deleteOriginFile: false, // 保留原文件
    }),
    // Brotli 压缩：比 Gzip 小 15-25%，现代浏览器均支持
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
      deleteOriginFile: false,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // API 代理：将 /api 开头的请求转发到后端 3300 端口
    // 前端代码只需写 /api/xxx，不需要硬编码 http://127.0.0.1:3300
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3300',
        changeOrigin: true,
        // 不重写路径 —— /api/auth/login → http://127.0.0.1:3300/api/auth/login
      },
    },
  },
  build: {
    target: 'es2020',          // 减少 polyfill 注入，现代手机浏览器已全覆盖
    cssCodeSplit: true,        // CSS 按路由拆分，非首屏样式延迟加载
    rollupOptions: {
      output: {
        // 手动分包：把稳定的三方库单独打包，最大化浏览器长期缓存命中
        manualChunks(id: string) {
          if (id.includes('node_modules/vant')) {
            return 'vant'
          }
          if (
            id.includes('node_modules/vue') ||
            id.includes('node_modules/vue-router') ||
            id.includes('node_modules/pinia')
          ) {
            return 'vue-vendor'
          }
        },
      },
    },
  },
})
