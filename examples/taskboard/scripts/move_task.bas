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
                End If
            End If
        End If
    End If
END EVENT