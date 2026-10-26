/** Used by the automatic style builder (.github/workflows/build-styles.yml). Same settings the app used before. */
module.exports = {
  content: ['./index.html', './classes.html'],
  darkMode: 'class',
  theme: { extend: { colors: { brand: { 50: '#FEF1EF', 100: '#FBE0DB', 200: '#F7C6BD', 300: '#EE8F80', 400: '#E05A47', 500: '#D14A38', 600: '#B93F2F', 700: '#9E3326', 800: '#7C281D', 900: '#5A1D15', 950: '#1E232A' } } } }
};
