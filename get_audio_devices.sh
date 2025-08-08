#!/bin/bash

# Grab audio sinks with pw-dump like a PipeWire wizard, squashing JSON into single lines
pw-dump | jq -c '.[] | select(.type == "PipeWire:Interface:Node" and .info.props."media.class" == "Audio/Sink") | {"id": .id, "desc": .info.props."node.description"}'
