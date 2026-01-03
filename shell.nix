{
  pkgs ? import <nixpkgs> {},
  system,
  bun2nix,
}:
pkgs.mkShell {
  buildInputs = [
    bun2nix.packages.${system}.default
    pkgs.bun
    pkgs.openssl
  ];
}
