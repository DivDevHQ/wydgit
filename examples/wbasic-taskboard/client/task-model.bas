PUBLIC CLASS TaskModel EXTENDS wydgit.core/block
    META Id = "divdev/task-model"
    CONTENT MARKDOWN ""
    PUBLIC PROPERTY Added AS Array = []
    PUBLIC SUB AddTask(Title AS String, State AS String)
        DIM row AS Object = {"Key":"local" & Convert(Length(Me.Added) + 1,String),"Title":Title,"Status":State}
        SELECT CASE Length(Me.Added)
            CASE 0
                Me.Added = [row]
            CASE 1
                Me.Added = [Me.Added[0],row]
            CASE 2
                Me.Added = [Me.Added[0],Me.Added[1],row]
        END SELECT
    END SUB
    PUBLIC SUB ClearTasks()
        Me.Added = []
    END SUB
    PUBLIC FUNCTION LoadTasks(PageNumber AS Integer) AS Array
        DIM first AS Object = {"Key":"alpha","Title":"Write WBasic","Status":"Complete"}
        DIM second AS Object = {"Key":"beta","Title":"Test canonical artifacts","Status":"Pending"}
        IF PageNumber = 2 THEN
            first = {"Key":"gamma","Title":"Verify lifecycle cleanup","Status":"Pending"}
            SELECT CASE Length(Me.Added)
                CASE 0
                    RETURN [first]
                CASE 1
                    RETURN [first,Me.Added[0]]
                CASE 2
                    RETURN [first,Me.Added[0],Me.Added[1]]
                CASE ELSE
                    RETURN [first,Me.Added[0],Me.Added[1],Me.Added[2]]
            END SELECT
        END IF
        SELECT CASE Length(Me.Added)
            CASE 0
                RETURN [first,second]
            CASE 1
                RETURN [first,second,Me.Added[0]]
            CASE 2
                RETURN [first,second,Me.Added[0],Me.Added[1]]
            CASE ELSE
                RETURN [first,second,Me.Added[0],Me.Added[1],Me.Added[2]]
        END SELECT
    END FUNCTION
END CLASS
