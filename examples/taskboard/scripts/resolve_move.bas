FUNCTION FindNode(parent AS Wydgit, slotName AS String, sId AS String) AS Wydgit
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

    Dim reqOffset As String
    reqOffset = REQUEST.Form.Get("pageOffset")

    If reqRecId <> "" Then
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

                Dim titleStr As String
                titleStr = taskData.title

                Dim currentStatus As String
                currentStatus = taskData.status

                Dim nextStatus As String
                Dim btnLabel As String
                Dim colId As String

                If currentStatus = "doing" Then
                    nextStatus = "done"
                    btnLabel = "Complete ->"
                    colId = "col-doing"
                ElseIf currentStatus = "done" Then
                    nextStatus = "todo"
                    btnLabel = "<- Reopen"
                    colId = "col-done"
                Else
                    nextStatus = "doing"
                    btnLabel = "Start ->"
                    colId = "col-todo"
                End If

                Dim cardId As String
                cardId = "task-card-" & reqRecId

                Dim card As Wydgit
                SET card = NEW "divdev/task-card"(cardId)
                card.taskTitle = "**" & titleStr & "**"
                card.status = currentStatus
                card.recordId = reqRecId

                If reqOffset = "" Then
                    reqOffset = "0"
                End If

                ' 1. Move Form Receiver (Target)
                Dim reconstructedForm As Wydgit
                SET reconstructedForm = NEW "divdev/task-move-form"(expectedTarget)
                reconstructedForm.label = titleStr & " | " & btnLabel

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

                Dim hiddenOffset As Wydgit
                SET hiddenOffset = NEW "wydgit.core/hidden-input"(expectedTarget & "-offset")
                hiddenOffset.name = "pageOffset"
                hiddenOffset.value = reqOffset
                reconstructedForm.Insert("blocks", 2, hiddenOffset)

                card.Insert("blocks", 0, reconstructedForm)

                ' 2. Delete Form
                Dim delForm As Wydgit
                SET delForm = NEW "divdev/task-delete-form"("task-card-delete-" & reqRecId)
                delForm.label = "Delete"

                Dim hiddenDelRec As Wydgit
                SET hiddenDelRec = NEW "wydgit.core/hidden-input"("task-card-delete-" & reqRecId & "-recid")
                hiddenDelRec.name = "recordId"
                hiddenDelRec.value = reqRecId
                delForm.Insert("blocks", 0, hiddenDelRec)

                Dim hiddenDelOffset As Wydgit
                SET hiddenDelOffset = NEW "wydgit.core/hidden-input"("task-card-delete-" & reqRecId & "-offset")
                hiddenDelOffset.name = "pageOffset"
                hiddenDelOffset.value = reqOffset
                delForm.Insert("blocks", 1, hiddenDelOffset)

                card.Insert("blocks", 1, delForm)

                Dim listSec As Wydgit
                SET listSec = FindNode(Me, "blocks", "taskboard-list-section")

                If listSec IS NOT NULL Then
                    Dim targetCol As Wydgit
                    SET targetCol = FindNode(listSec, "blocks", colId)

                    If targetCol IS NOT NULL Then
                        targetCol.Insert("blocks", 1, card)
                    End If
                End If
            End If
        End If
    End If
END EVENT