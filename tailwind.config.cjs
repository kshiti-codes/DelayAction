module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#05164d',
        'navy-light': '#0a2170',
        amber: '#FFAD00',
        'amber-dim': '#cc8a00',
        'red-alert': '#ff3b3b',
        'orange-warn': '#ff8c00',
        'yellow-mod': '#ffd600',
        'green-ok': '#00e676',
        'text-prim': '#f0f4ff',
        'text-dim': '#8899cc',
        border: '#1a2d6b',
        glass: 'rgba(10, 33, 112, 0.6)',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['"DM Mono"', 'monospace'],
        ui: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};