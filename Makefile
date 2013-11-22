PYTHON   = python
BUILDER = closure-library/closure/bin/build/closurebuilder.py
COMPILER = closure-library/compiler.jar
 
all:
	$(PYTHON) $(BUILDER) --root=closure-library/ --root=jsptp/ --namespace="ptp" --output_mode=compiled --compiler_jar=$(COMPILER) > ptp_compiled.js
