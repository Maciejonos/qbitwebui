{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";

    bun2nix.url = "github:nix-community/bun2nix";
    bun2nix.inputs.nixpkgs.follows = "nixpkgs";

    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    bun2nix,
    nixpkgs,
    flake-utils,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            bun
            bun2nix.packages.${system}.default
            openssl
          ];
        };
        packages = rec {
          default = qbitwebui;
          qbitwebui = pkgs.callPackage ./package.nix {
            bun2nix = bun2nix.packages.${system}.default;
          };
        };
      }
    );
}
