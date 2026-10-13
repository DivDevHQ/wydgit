FUNCTION FindNode(parent AS Wydgit, slotName AS String, sId AS String) AS Wydgit
    FOR EACH node IN parent.related("children", slotName)
        IF node.id = sId THEN
            RETURN node
        END IF
    NEXT node
    RETURN NULL
END FUNCTION

EVENT Submit
    Dim postedOffset As String
    postedOffset = REQUEST.Form.Get("offset")

    If postedOffset <> "" Then
        Dim pagingForm As Wydgit
        SET pagingForm = Me

        Dim rootSec As Wydgit
        SET rootSec = pagingForm.related("parent")

        If rootSec IS NOT NULL Then
            Dim pageForm As Wydgit
            SET pageForm = FindNode(rootSec, "blocks", "taskboard-page-form")
            If pageForm IS NOT NULL Then
                Dim pageOffsetField As Wydgit
                SET pageOffsetField = FindNode(pageForm, "blocks", "taskboard-page-offset")
                If pageOffsetField IS NOT NULL Then
                    pageOffsetField.value = postedOffset
                End If
            End If

            Dim prevForm As Wydgit
            SET prevForm = FindNode(rootSec, "blocks", "taskboard-prev-form")
            If prevForm IS NOT NULL Then
                Dim prevOffsetField As Wydgit
                SET prevOffsetField = FindNode(prevForm, "blocks", "taskboard-prev-offset")
                If prevOffsetField IS NOT NULL Then
                    prevOffsetField.value = postedOffset
                End If
            End If
        End If
    End If
END EVENT