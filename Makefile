HUGO_VERSION=0.124.1
THEME_REPO=github.com/adityatelange/hugo-PaperMod

.PHONY: hugo-update theme-update server build clean

hugo-update:
	@echo "Updating Hugo to version $(HUGO_VERSION)..."
	go install github.com/gohugoio/hugo@v$(HUGO_VERSION)

theme-update:
	@echo "Updating PaperMod theme..."
	git clone https://github.com/adityatelange/hugo-PaperMod themes/PaperMod --depth=1

server:
	@echo "Starting Hugo server..."
	hugo server

build:
	@echo "Building site..."
	hugo

clean:
	@echo "Cleaning public directory..."
	rm -rf public

help:
	@echo "Available targets:"
	@echo "  hugo-update   - Update Hugo to the specified version"
	@echo "  theme-update  - Update/download the PaperMod theme"
	@echo "  server        - Run Hugo development server"
	@echo "  build         - Build the site"
	@echo "  clean         - Remove the public directory"
