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

func TestRequireImportConfirm(t *testing.T) {
	if requireImportConfirm(true, "") {
		t.Fatal("expected destructive import without confirm to fail")
	}
	if !requireImportConfirm(true, "IMPORT") {
		t.Fatal("expected destructive import with confirm to pass")
	}
	if !requireImportConfirm(false, "") {
		t.Fatal("expected non-destructive import without confirm to pass")
	}
}
