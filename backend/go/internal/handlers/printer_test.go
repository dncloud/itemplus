package handlers

import "testing"

func TestHexColorValidation(t *testing.T) {
	if !hexColorRe.MatchString("00ff99") {
		t.Fatal("expected valid hex color to pass")
	}
	if hexColorRe.MatchString(`fff" onload="alert(1)`) {
		t.Fatal("expected invalid SVG-breaking color to fail")
	}
}
