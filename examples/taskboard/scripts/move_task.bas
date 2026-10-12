FUNCTION FindNode(parent AS Wydgit, slotName AS String, sId AS String) AS Wydgit
    FOR EACH node IN parent.related("children", slotName)
        IF node.id = sId THEN
            RETURN node
        END IF
    NEXT node
    RETURN NULL
END FUNCTION

EVENT Submit
    Dim targetRecId As String
    targetRecId = REQUEST.Form.Get("recordId")

    Dim newStatus As String
    newStatus = REQUEST.Form.Get("targetStatus")

    If newStatus = "todo" OR newStatus = "doing" OR newStatus = "done" Then
        If targetRecId <> "" Then
            Dim getRes As Object
            getRes = SERVICES.Call("wydstore", "get", {
                "store": "tasks",
                "collection": "tasks",
                "id": targetRecId
            })

            If getRes.ok Then
                Dim recSnapshot As Object
                recSnapshot = getRes.value

                Dim titleStr As String
                Dim currentData As Object
                currentData = recSnapshot.data
                titleStr = currentData.title

                Dim currentStatus As String
                currentStatus = currentData.status

                Dim validTransition As Boolean
                validTransition = False

                If currentStatus = "todo" AND newStatus = "doing" Then
                    validTransition = True
                ElseIf currentStatus = "doing" AND newStatus = "done" Then
                    validTransition = True
                ElseIf currentStatus = "done" AND newStatus = "todo" Then
                    validTransition = True
                End If

                If validTransition Then
                    Dim currentVersion As Number
                    currentVersion = recSnapshot.version

                    Dim updateRes As Object
                    updateRes = SERVICES.Call("wydstore", "update", {
                        "store": "tasks",
                        "collection": "tasks",
                        "id": targetRecId,
                        "version": currentVersion,
                        "data": {
                            "title": titleStr,
                            "status": newStatus
                        }
                    })

                    If updateRes.ok Then
                        Dim moveForm As Wydgit
                        SET moveForm = Me

                        Dim cardObj As Wydgit
                        SET cardObj = moveForm.related("parent")

                        If cardObj IS NOT NULL Then
                            Dim oldColObj As Wydgit
                            SET oldColObj = cardObj.related("parent")

                            If oldColObj IS NOT NULL Then
                                Dim listSec As Wydgit
                                SET listSec = oldColObj.related("parent")

                                If listSec IS NOT NULL Then
                                    Dim targetColId As String
                                    Dim nextStatusArg As String
                                    Dim nextBtnLabel As String

                                    If newStatus = "doing" Then
                                        targetColId = "col-doing"
                                        nextStatusArg = "done"
                                        nextBtnLabel = "Complete ->"
                                    ElseIf newStatus = "done" Then
                                        targetColId = "col-done"
                                        nextStatusArg = "todo"
                                        nextBtnLabel = "<- Reopen"
                                    Else
                                        targetColId = "col-todo"
                                        nextStatusArg = "doing"
                                        nextBtnLabel = "Start ->"
                                    End If

                                    Dim newColObj As Wydgit
                                    SET newColObj = FindNode(listSec, "blocks", targetColId)

                                    If newColObj IS NOT NULL Then
                                        ' Atomic reparenting via Move()
                                        cardObj.Move(newColObj, "blocks", 1)

                                        ' Sync card status property
                                        cardObj.status = newStatus

                                        ' Update move form label & next status hidden input
                                        moveForm.label = nextBtnLabel

                                        Dim statusHidden As Wydgit
                                        SET statusHidden = FindNode(moveForm, "blocks", "task-card-move-" & targetRecId & "-status")
                                        If statusHidden IS NOT NULL Then
                                            statusHidden.value = nextStatusArg
                                        End If
                                    End If
                                End If
                            End If
                        End If
                    End If
                End If
            End If
        End If
    End If
END EVENT