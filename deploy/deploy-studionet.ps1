$ErrorActionPreference = "Stop"

param(
  [string]$PlatformName = "AccordMesh",
  [string]$RulesUri = "ipfs://community-rules"
)

genlayer network studionet
genlayer deploy --contract contracts/accord_mesh.py --args $PlatformName $RulesUri

