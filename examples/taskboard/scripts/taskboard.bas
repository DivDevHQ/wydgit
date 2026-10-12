FUNCTION FindNode(parent AS Wydgit, slotName AS String, sId AS String) AS Wydgit
    FOR EACH node IN parent.related("children", slotName)
        IF node.id = sId THEN
            RETURN node
        END IF
    NEXT node
    RETURN NULL
END FUNCTION

EVENT Page.PreRender
    Dim res As Object
    res = SERVICES.Call("wydstore", "query", {
        "store": "tasks",
        "collection": "tasks",
        "limit": 8
    })

    Dim rootSec As Wydgit
    SET rootSec = Me

    Dim statusBlock As Wydgit
    SET statusBlock = FindNode(rootSec, "blocks", "taskboard-status-msg")

    If res.ok Then
        Dim listSec As Wydgit
        SET listSec = FindNode(rootSec, "blocks", "taskboard-list-section")

        Dim colTodo As Wydgit
        Dim colDoing As Wydgit
        Dim colDone As Wydgit

        IF listSec IS NOT NULL THEN
            SET colTodo = FindNode(listSec, "blocks", "col-todo")
            SET colDoing = FindNode(listSec, "blocks", "col-doing")
            SET colDone = FindNode(listSec, "blocks", "col-done")
        END IF

        Dim records As Array
        records = res.value

        ' Hoisted variables
        Dim taskData As Object
        Dim titleStr As String
        Dim statusStr As String
        Dim recId As String
        Dim cardId As String
        Dim card As Wydgit
        Dim targetCol As Wydgit

        Dim idxTodo As Number
        Dim idxDoing As Number
        Dim idxDone As Number
        idxTodo = 1
        idxDoing = 1
        idxDone = 1

        Dim targetIdx As Number
        Dim nextStatus As String
        Dim btnLabel As String

        Dim titleBlock As Wydgit
        Dim moveForm As Wydgit
        Dim recIdHiddenMove As Wydgit
        Dim nextStatusHidden As Wydgit
        Dim delForm As Wydgit
        Dim recIdHiddenDel As Wydgit
        Dim existingCard As Wydgit

        FOR EACH rec IN records
            recId = rec.id
            taskData = rec.data
            titleStr = taskData.title
            statusStr = taskData.status

            If statusStr = "doing" Then
                SET targetCol = colDoing
                targetIdx = idxDoing
                idxDoing = idxDoing + 1
                nextStatus = "done"
                btnLabel = "Complete ->"
            ElseIf statusStr = "done" Then
                SET targetCol = colDone
                targetIdx = idxDone
                idxDone = idxDone + 1
                nextStatus = "todo"
                btnLabel = "<- Reopen"
            Else
                SET targetCol = colTodo
                targetIdx = idxTodo
                idxTodo = idxTodo + 1
                nextStatus = "doing"
                btnLabel = "Start ->"
            End If

            cardId = "task-card-" & recId

            ' Search across all columns for existing reconstructed card
            SET existingCard = NULL
            IF colTodo IS NOT NULL THEN
                IF existingCard IS NULL THEN
                    SET existingCard = FindNode(colTodo, "blocks", cardId)
                END IF
            END IF
            IF colDoing IS NOT NULL THEN
                IF existingCard IS NULL THEN
                    SET existingCard = FindNode(colDoing, "blocks", cardId)
                END IF
            END IF
            IF colDone IS NOT NULL THEN
                IF existingCard IS NULL THEN
                    SET existingCard = FindNode(colDone, "blocks", cardId)
                END IF
            END IF

            IF existingCard IS NULL THEN
                IF targetCol IS NOT NULL THEN
                    SET card = NEW "divdev/task-card"(cardId)
                    card.taskTitle = titleStr
                    card.status = statusStr
                    card.recordId = recId

                    ' 1. Title Block
                    SET titleBlock = NEW "wydgit.core/block"(cardId & "-title")
                    titleBlock.content = {
                        "type": "markdown",
                        "value": "**" & titleStr & "**"
                    }
                    card.Insert("blocks", 0, titleBlock)

                    ' 2. Move Form
                    SET moveForm = NEW "divdev/task-move-form"("task-card-move-" & recId)
                    moveForm.label = btnLabel

                    SET recIdHiddenMove = NEW "wydgit.core/hidden-input"("task-card-move-" & recId & "-recid")
                    recIdHiddenMove.name = "recordId"
                    recIdHiddenMove.value = recId
                    moveForm.Insert("blocks", 0, recIdHiddenMove)

                    SET nextStatusHidden = NEW "wydgit.core/hidden-input"("task-card-move-" & recId & "-status")
                    nextStatusHidden.name = "targetStatus"
                    nextStatusHidden.value = nextStatus
                    moveForm.Insert("blocks", 1, nextStatusHidden)

                    card.Insert("blocks", 1, moveForm)

                    ' 3. Delete Form
                    SET delForm = NEW "divdev/task-delete-form"("task-card-delete-" & recId)
                    delForm.label = "Delete"

                    SET recIdHiddenDel = NEW "wydgit.core/hidden-input"("task-card-delete-" & recId & "-recid")
                    recIdHiddenDel.name = "recordId"
                    recIdHiddenDel.value = recId
                    delForm.Insert("blocks", 0, recIdHiddenDel)

                    card.Insert("blocks", 2, delForm)

                    targetCol.Insert("blocks", targetIdx, card)
                END IF
            END IF
        NEXT rec
    Else
        IF statusBlock IS NOT NULL THEN
            statusBlock.content = {
                "type": "markdown",
                "value": "Failed to load tasks from storage."
            }
        END IF
    End If
END EVENT