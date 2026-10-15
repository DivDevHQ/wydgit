PUBLIC CLASS Taskboard EXTENDS wydgit.core/section
    META Id = "divdev/taskboard"
    PUBLIC PROPERTY CurrentPage AS Number = 1
    PUBLIC PROPERTY Message AS String = "Ready. Add up to three local tasks."
    PUBLIC PROPERTY LoadCount AS Number = 0
    CHILD Model AS "divdev/task-model" INTO blocks
    END CHILD
    CHILD List AS "divdev/task-list" INTO blocks
    END CHILD
    CHILD Pager AS "divdev/task-navigation" INTO blocks
    END CHILD
    PUBLIC SUB SelectPage(PageNumber AS Integer)
        Me.Pager.GoToPage(PageNumber)
    END SUB
    PUBLIC SUB NextPage()
        IF Me.CurrentPage = 1 THEN
            Me.SelectPage(2)
        ELSE
            Me.SelectPage(1)
        END IF
    END SUB
    PUBLIC SUB SubmitTask(data AS Object)
        IF Length(Me.Model.Added) >= 3 THEN
            Me.Message = "Three local tasks already added. Clear them to start again."
        ELSE
            DIM state AS String = data.State
            IF data.Complete THEN
                state = "Complete"
            END IF
            Me.Model.AddTask(data.Title,state)
            Me.ApplyPage()
            Me.Message = "Added: " & data.Title & " " & data.Notes
        END IF
    END SUB
    PUBLIC SUB ClearTasks()
        Me.Model.ClearTasks()
        Me.ApplyPage()
        Me.Message = "Local tasks cleared."
    END SUB
    PRIVATE SUB ApplyPage()
        Me.List.Tasks = Me.Model.LoadTasks(Me.CurrentPage)
    END SUB
    PRIVATE SUB OnPageChanged(PageNumber AS Integer)
        Me.CurrentPage = PageNumber
        Me.ApplyPage()
    END SUB
    PRIVATE SUB OnPageLoad()
        Me.LoadCount = Me.LoadCount + 1
    END SUB
    BIND EVENT Pager.PageChanged TO Me.OnPageChanged
    BIND EVENT Page.Load TO Me.OnPageLoad
    PROTECTED OVERRIDE SUB Preload()
        Me.ApplyPage()
    END SUB
    PRESENTATION CLIENT
        HEADING "Interactive WBasic Taskboard"
        CONTENT Me.CurrentPage
        BUTTON Next LABEL "Next page" CALL NextPage
        BUTTON Clear LABEL "Clear local tasks" CALL ClearTasks
        FORM NewTask CALL SubmitTask
            INPUT Title AS String LABEL "Task title" LIMIT 80 REQUIRED
            TEXTAREA Notes AS String LABEL "Notes" LIMIT 240
            CHECKBOX Complete AS Boolean LABEL "Already complete" LIMIT 1
            SELECT State AS String LABEL "Task state" LIMIT 16 OPTIONS ["Pending","Complete"]
            SUBMIT Save LABEL "Add task"
            RESET Reset LABEL "Reset draft"
        END FORM
        STATUS Feedback VALUE Me.Message
    END PRESENTATION
END CLASS
