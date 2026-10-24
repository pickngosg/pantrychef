/** Used by the automatic style builder (.github/workflows/build-styles.yml). Same settings the app used before. */
module.exports = {
  content: ['./index.html', './classes.html'],
  darkMode: 'class',
  theme: { extend: { colors: { brand: { 50: '#EAF3ED', 100: '#DCEBE1', 200: '#BBD6C4', 300: '#8FBBA0', 400: '#5FAF86', 500: '#1F6B4A', 600: '#1A5C40', 700: '#145238', 800: '#0F4030', 900: '#0B3023', 950: '#14211C' } } } }
};
