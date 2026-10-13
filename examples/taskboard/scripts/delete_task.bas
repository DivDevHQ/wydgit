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

    Dim postedOffset As String
    postedOffset = REQUEST.Form.Get("pageOffset")

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

            Dim currentVersion As Number
            currentVersion = recSnapshot.version

            Dim delRes As Object
            delRes = SERVICES.Call("wydstore", "delete", {
                "store": "tasks",
                "collection": "tasks",
                "id": targetRecId,
                "version": currentVersion
            })

            If delRes.ok Then
                Dim cardObj As Wydgit
                SET cardObj = Me.related("parent")

                If cardObj IS NOT NULL Then
                    Dim colObj As Wydgit
                    SET colObj = cardObj.related("parent")

                    If colObj IS NOT NULL Then
                        Dim listSec As Wydgit
                        SET listSec = colObj.related("parent")

                        If listSec IS NOT NULL Then
                            Dim rootSec As Wydgit
                            SET rootSec = listSec.related("parent")

                            If rootSec IS NOT NULL AND postedOffset <> "" Then
                                Dim pageForm As Wydgit
                                SET pageForm = FindNode(rootSec, "blocks", "taskboard-page-form")
                                If pageForm IS NOT NULL THEN
                                    Dim offsetField AS Wydgit
                                    SET offsetField = FindNode(pageForm, "blocks", "taskboard-page-offset")
                                    IF offsetField IS NOT NULL THEN
                                        offsetField.value = postedOffset
                                    END IF
                                END IF
                            End If
                        End If
                    End If
                    cardObj.Remove()
                END IF
            End If
        End If
    End If
END EVENT