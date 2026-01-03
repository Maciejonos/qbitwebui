{
  pkgs ? import <nixpkgs> {},
  bun2nix,
}:
pkgs.mkShell {
  buildInputs = with pkgs; [
    bun
    bun2nix.packages.${system}.default
    openssl
  ];
}
