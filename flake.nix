{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = import nixpkgs { inherit system; };
      in {
        # Development environment
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            pnpm
            just
            links2 # Text-based browser (links)
          ];

          shellHook = ''
            export PATH="$PWD/node_modules/.bin:$PATH"
            echo "web-cli development environment"
            echo "Run 'just' to see available commands"
          '';
        };
      });
}
