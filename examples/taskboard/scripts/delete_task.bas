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
        End If
    End If
END EVENT