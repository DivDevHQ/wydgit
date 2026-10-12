EVENT Submit
    Dim targetRecId As String
    targetRecId = REQUEST.Form.Get("recordId")

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
                ' Detach deleted card receiver from tree using zero-argument Remove()
                Dim cardObj As Wydgit
                SET cardObj = Me.related("parent")

                If cardObj IS NOT NULL Then
                    cardObj.Remove()
                End If
            End If
        End If
    End If
END EVENT