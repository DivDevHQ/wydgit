FUNCTION FindNode(parent AS Wydgit, slotName AS String, sId AS String) AS Wydgit
    Dim node AS Wydgit
    FOR EACH node IN parent.related("children", slotName)
        IF node.id = sId THEN
            RETURN node
        END IF
    NEXT node
    RETURN NULL
END FUNCTION

EVENT Page.Resolve
    Dim reqTarget As String
    reqTarget = REQUEST.Route.target

    Dim reqRecId As String
    reqRecId = REQUEST.Form.Get("recordId")

    If reqRecId <> "" Then
        ' Verify candidate target matches prefix
        Dim expectedTarget As String
        expectedTarget = "task-card-move-" & reqRecId

        If reqTarget = expectedTarget Then
            Dim getRes As Object
            getRes = SERVICES.Call("wydstore", "get", {
                "store": "tasks",
                "collection": "tasks",
                "id": reqRecId
            })

            If getRes.ok Then
                Dim recSnapshot As Object
                recSnapshot = getRes.value

                Dim taskData As Object
                taskData = recSnapshot.data

                Dim currentStatus As String
                currentStatus = taskData.status

                Dim nextStatus As String
                If currentStatus = "todo" Then
                    nextStatus = "doing"
                ElseIf currentStatus = "doing" Then
                    nextStatus = "done"
                Else
                    nextStatus = "todo"
                End If

                Dim reconstructedForm As Wydgit
                SET reconstructedForm = NEW "divdev/task-move-form"(expectedTarget)
                reconstructedForm.label = "Move ->"

                Dim hiddenRec As Wydgit
                SET hiddenRec = NEW "wydgit.core/hidden-input"(expectedTarget & "-recid")
                hiddenRec.name = "recordId"
                hiddenRec.value = reqRecId
                reconstructedForm.Insert("blocks", 0, hiddenRec)

                Dim hiddenStatus As Wydgit
                SET hiddenStatus = NEW "wydgit.core/hidden-input"(expectedTarget & "-status")
                hiddenStatus.name = "targetStatus"
                hiddenStatus.value = nextStatus
                reconstructedForm.Insert("blocks", 1, hiddenStatus)

                ' Attach reconstructed form into tree under list section
                Dim listSec As Wydgit
                SET listSec = FindNode(Me, "blocks", "taskboard-list-section")

                If listSec IsNot NULL Then
                    listSec.Insert("blocks", 0, reconstructedForm)
                End If
            End If
        End If
    End If
END EVENT