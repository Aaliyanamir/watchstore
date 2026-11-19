import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'mpa',
  server: { host: '127.0.0.1', port: 5190, strictPort: true, hmr: false },
  preview: { host: '127.0.0.1', port: 5191 },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: {
        root: 'index.html',
        main: 'examples/AURELUX/index.html',
        shop: 'examples/AURELUX/shop.html',
        cart: 'examples/AURELUX/cart.html',
        calibre: 'examples/AURELUX/calibre.html',
        craft: 'examples/AURELUX/craft.html',
        atelier: 'examples/AURELUX/atelier.html',
        clientCare: 'examples/AURELUX/client-care.html',
        appointments: 'examples/AURELUX/appointments.html',
        deliveryReturns: 'examples/AURELUX/delivery-returns.html',
        adminLogin: 'examples/AURELUX/admin/login.html',
        adminDashboard: 'examples/AURELUX/admin/dashboard.html',
      },
    },
  },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
});
