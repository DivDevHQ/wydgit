FUNCTION FindNode(parent AS Wydgit, slotName AS String, sId AS String) AS Wydgit
    FOR EACH node IN parent.related("children", slotName)
        IF node.id = sId THEN
            RETURN node
        END IF
    NEXT node
    RETURN NULL
END FUNCTION

EVENT Page.PreRender
    Dim currentOffset As Number
    currentOffset = 0

    Dim pageForm As Wydgit
    SET pageForm = FindNode(Me, "blocks", "taskboard-page-form")

    ' Read current offset state set by action handlers or form defaults
    If pageForm IS NOT NULL Then
        Dim offsetField AS Wydgit
        SET offsetField = FindNode(pageForm, "blocks", "taskboard-page-offset")
        If offsetField IS NOT NULL Then
            Dim rawOffsetVal AS String
            rawOffsetVal = offsetField.properties.value
            If rawOffsetVal IS NOT NULL THEN
                If rawOffsetVal <> "" Then
                    TRY
                        currentOffset = Val(rawOffsetVal)
                        If currentOffset < 0 Then
                            currentOffset = 0
                        End If
                    CATCH err
                        currentOffset = 0
                    FINALLY
                    END TRY
                End If
            End If
        End If
    End If

    Dim res As Object
    res = SERVICES.Call("wydstore", "query", {
        "store": "tasks",
        "collection": "tasks",
        "limit": 8,
        "offset": currentOffset
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

        Dim moveForm As Wydgit
        Dim recIdHiddenMove As Wydgit
        Dim nextStatusHidden As Wydgit
        Dim offsetHiddenMove As Wydgit
        Dim delForm As Wydgit
        Dim recIdHiddenDel As Wydgit
        Dim offsetHiddenDel As Wydgit
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
                    card.taskTitle = "**" & titleStr & "**"
                    card.status = statusStr
                    card.recordId = recId

                    ' 1. Move Form
                    SET moveForm = NEW "divdev/task-move-form"("task-card-move-" & recId)
                    moveForm.label = titleStr & " | " & btnLabel

                    SET recIdHiddenMove = NEW "wydgit.core/hidden-input"("task-card-move-" & recId & "-recid")
                    recIdHiddenMove.name = "recordId"
                    recIdHiddenMove.value = recId
                    moveForm.Insert("blocks", 0, recIdHiddenMove)

                    SET nextStatusHidden = NEW "wydgit.core/hidden-input"("task-card-move-" & recId & "-status")
                    nextStatusHidden.name = "targetStatus"
                    nextStatusHidden.value = nextStatus
                    moveForm.Insert("blocks", 1, nextStatusHidden)

                    SET offsetHiddenMove = NEW "wydgit.core/hidden-input"("task-card-move-" & recId & "-offset")
                    offsetHiddenMove.name = "pageOffset"
                    offsetHiddenMove.value = CStr(currentOffset)
                    moveForm.Insert("blocks", 2, offsetHiddenMove)

                    card.Insert("blocks", 0, moveForm)

                    ' 2. Delete Form
                    SET delForm = NEW "divdev/task-delete-form"("task-card-delete-" & recId)
                    delForm.label = "Delete"

                    SET recIdHiddenDel = NEW "wydgit.core/hidden-input"("task-card-delete-" & recId & "-recid")
                    recIdHiddenDel.name = "recordId"
                    recIdHiddenDel.value = recId
                    delForm.Insert("blocks", 0, recIdHiddenDel)

                    SET offsetHiddenDel = NEW "wydgit.core/hidden-input"("task-card-delete-" & recId & "-offset")
                    offsetHiddenDel.name = "pageOffset"
                    offsetHiddenDel.value = CStr(currentOffset)
                    delForm.Insert("blocks", 1, offsetHiddenDel)

                    card.Insert("blocks", 1, delForm)

                    targetCol.Insert("blocks", targetIdx, card)
                END IF
            END IF
        NEXT rec

        ' Calculate next/previous target offsets for subsequent render actions
        Dim prevForm As Wydgit
        SET prevForm = FindNode(rootSec, "blocks", "taskboard-prev-form")

        IF prevForm IS NOT NULL THEN
            Dim prevOffsetField AS Wydgit
            SET prevOffsetField = FindNode(prevForm, "blocks", "taskboard-prev-offset")
            IF prevOffsetField IS NOT NULL THEN
                Dim prevVal AS Number
                prevVal = currentOffset - 8
                If prevVal < 0 Then
                    prevVal = 0
                End If
                prevOffsetField.value = CStr(prevVal)
            END IF
        END IF

        IF pageForm IS NOT NULL THEN
            Dim nextOffsetField AS Wydgit
            SET nextOffsetField = FindNode(pageForm, "blocks", "taskboard-page-offset")
            IF nextOffsetField IS NOT NULL THEN
                nextOffsetField.value = CStr(currentOffset + 8)
            END IF
        END IF
    Else
        IF statusBlock IS NOT NULL THEN
            statusBlock.content = {
                "type": "markdown",
                "value": "Failed to load tasks from storage."
            }
        END IF
    End If
END EVENT