// src/css.d.ts
// This file tells TypeScript how to handle imports for CSS Modules.
// It declares that any import ending in '.module.css' will export an object
// where keys are class names (strings) and values are the generated unique class names (strings).

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// If you also use .module.scss or .module.sass, you can add declarations for them too:
/*
declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.sass' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
*/
