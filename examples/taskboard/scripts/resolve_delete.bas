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

    If reqRecId <> "" Then
        Dim expectedTarget As String
        expectedTarget = "task-card-delete-" & reqRecId

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

                Dim colId As String
                If currentStatus = "doing" Then
                    colId = "col-doing"
                ElseIf currentStatus = "done" Then
                    colId = "col-done"
                Else
                    colId = "col-todo"
                End If

                Dim cardId As String
                cardId = "task-card-" & reqRecId

                Dim card As Wydgit
                SET card = NEW "divdev/task-card"(cardId)
                card.taskTitle = titleStr
                card.status = currentStatus
                card.recordId = reqRecId

                ' Title Block
                Dim titleBlock As Wydgit
                SET titleBlock = NEW "wydgit.core/block"(cardId & "-title")
                titleBlock.content = {
                    "type": "markdown",
                    "value": "**" & titleStr & "**"
                }
                card.Insert("blocks", 0, titleBlock)

                ' Move Form
                Dim moveForm As Wydgit
                SET moveForm = NEW "divdev/task-move-form"("task-card-move-" & reqRecId)
                moveForm.label = "Move"

                Dim hiddenRecMove As Wydgit
                SET hiddenRecMove = NEW "wydgit.core/hidden-input"("task-card-move-" & reqRecId & "-recid")
                hiddenRecMove.name = "recordId"
                hiddenRecMove.value = reqRecId
                moveForm.Insert("blocks", 0, hiddenRecMove)

                card.Insert("blocks", 1, moveForm)

                ' Delete Form Receiver (Target)
                Dim reconstructedForm As Wydgit
                SET reconstructedForm = NEW "divdev/task-delete-form"(expectedTarget)
                reconstructedForm.label = "Delete"

                Dim hiddenRecDel As Wydgit
                SET hiddenRecDel = NEW "wydgit.core/hidden-input"(expectedTarget & "-recid")
                hiddenRecDel.name = "recordId"
                hiddenRecDel.value = reqRecId
                reconstructedForm.Insert("blocks", 0, hiddenRecDel)

                card.Insert("blocks", 2, reconstructedForm)

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