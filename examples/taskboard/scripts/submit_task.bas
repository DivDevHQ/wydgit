FUNCTION FindNode(parent AS Wydgit, slotName AS String, sId AS String) AS Wydgit
    FOR EACH node IN parent.related("children", slotName)
        IF node.id = sId THEN
            RETURN node
        END IF
    NEXT node
    RETURN NULL
END FUNCTION

EVENT Submit
    Dim inputTitle As String
    inputTitle = REQUEST.Form.Get("title")

    Dim inputStatus As String
    inputStatus = REQUEST.Form.Get("status")

    If inputStatus = "" Then
        inputStatus = "todo"
    End If

    Dim rootSec As Wydgit
    SET rootSec = Me.related("parent")

    Dim statusBlock As Wydgit
    IF rootSec IS NOT NULL THEN
        SET statusBlock = FindNode(rootSec, "blocks", "taskboard-status-msg")
    END IF

    If inputTitle <> "" Then
        Dim recordId As String
        recordId = NewId()

        Dim res As Object
        res = SERVICES.Call("wydstore", "create", {
            "store": "tasks",
            "collection": "tasks",
            "id": recordId,
            "data": {
                "title": inputTitle,
                "status": inputStatus
            }
        })

        If res.ok Then
            IF statusBlock IS NOT NULL THEN
                statusBlock.content = {
                    "type": "markdown",
                    "value": "Task created successfully!"
                }
            END IF

            Dim titleField As Wydgit
            SET titleField = FindNode(Me, "blocks", "taskboard-title-field")

            IF titleField IS NOT NULL THEN
                titleField.value = ""
            END IF
        Else
            IF statusBlock IS NOT NULL THEN
                statusBlock.content = {
                    "type": "markdown",
                    "value": "Failed to create task in store."
                }
            END IF
        End If
    End If
END EVENT