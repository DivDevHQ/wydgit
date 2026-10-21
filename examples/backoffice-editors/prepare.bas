EVENT Page.PreRender
DIM result AS Object
result = SERVICES.Call("backoffice", "preview", {})
IF result.ok THEN
FOR EACH child IN ME.related("children", "blocks")
IF child.Id = "workspace-preview" THEN
IF result.value.data.columns THEN
CALL child.Set("format", {"layout":"columns"})
ELSE
CALL child.Set("format", {"layout":"flow"})
END IF
FOR EACH block IN child.related("children", "blocks")
IF block.Id = "workspace-title" THEN
CALL block.Set("content", {"type":"markdown", "value":"## " & result.value.data.title})
END IF
IF block.Id = "workspace-body" THEN
CALL block.Set("content", {"type":"markdown", "value":result.value.data.body})
END IF
NEXT block
END IF
NEXT child
END IF
END EVENT
