idf_component_register(SRCS "main.c" "telemetry_task.c" "minmea.c"
                       INCLUDE_DIRS "."
                       LDFRAGMENTS linker_fragment.lf)