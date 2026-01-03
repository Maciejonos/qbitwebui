{bun2nix}:
bun2nix.mkDerivation (finalAttrs: {
  pname = "qbitwebui";
  version = "2.0.0";
  src = ./.;
  packageJson = ./package.json;
  bunDeps = bun2nix.fetchBunDeps {
    bunNix = ./bun.nix;
  };
  buildPhase = ''
    bun run build
  '';
  installPhase = ''
    mkdir -p $out/share/qbitwebui
    cp -r dist/ $out/share/qbitwebui/public
    echo "${finalAttrs.version}" > $out/share/qbitwebui/version.txt
  '';
})
