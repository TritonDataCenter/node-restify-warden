#
# Copyright (c) 2012, Joyent, Inc. All rights reserved.
#
# Makefile: top-level Makefile
#
# This Makefile contains only repo-specific logic and uses included makefiles
# to supply common targets (javascriptlint, jsstyle, restdown, etc.), which are
# used by other repos as well.
#

#
# Tools must be installed on the path
#
NPM		:= npm

#
# Files
#
JS_FILES	:= $(shell find lib tests -name '*.js' -not -name compat.js)
JSL_FILES_NODE  := $(JS_FILES)
JSSTYLE_FILES	:= $(JS_FILES)
JSSTYLE_FLAGS	:= -f tools/jsstyle.conf
JSL_CONF_NODE	:= tools/jsl.node.conf
ISTANBUL 	:= node_modules/.bin/istanbul
FAUCET	 	:= node_modules/.bin/faucet
ESLINT		 = ./node_modules/.bin/eslint
ESLINT_CONF	 = tools/eslint.node.conf
ESLINT_FILES	 = $(JS_FILES)

include ./tools/mk/Makefile.defs

$(ESLINT):
	$(NPM) install

$(ISTANBUL):
	$(NPM) install

$(FAUCET):
	$(NPM) install

all: $(JSL_EXEC) $(JSSTYLE_EXEC)
	$(NPM) install

.PHONY: check
check:: $(ESLINT)
	$(ESLINT) -c $(ESLINT_CONF) $(ESLINT_FILES)

test: 
	$(ISTANBUL) cover --print none tests/run.js

include ./tools/mk/Makefile.deps
ifeq ($(shell uname -s),SunOS)
	include ./tools/mk/Makefile.node_prebuilt.targ
else
	include ./tools/mk/Makefile.node.targ
endif
include ./tools/mk/Makefile.smf.targ
include ./tools/mk/Makefile.targ
