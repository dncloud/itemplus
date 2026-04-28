package config

import _ "embed"

//go:embed templates/default.env
var embeddedDefaultEnv string
