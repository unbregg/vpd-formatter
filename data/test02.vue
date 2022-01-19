<template >
<Modal
  v-model="visible"
  title="驳回"
  :width="350"
  class-name="reject-form-modal"
  :loading="loading"
  @on-ok="onOk(content.rejectReason)"
  @on-visible-change="onVisibleChange"
  ><Form ref="form" class="reject-form" label-position="left" :label-width="80" :model="content"
    ><FormItem
      label="驳回原因"
      prop="rejectReason"
      :rules="[{ required: true, message: '驳回原因不能为空', trigger: 'blur' }]"
      ><Input v-model="content.rejectReason" type="textarea" :rows="3" :autofocus="true"></Input></FormItem></Form
></Modal>
</template>
<script >
import { Input, Form, FormItem } from '@ss/mtd-vue';
/* eslint-disable @typescript-eslint/unbound-method */
export default {
    name: 'RejectFormModal',
    components: {
        [Input.name]: Input,
        [Form.name]: Form,
        [FormItem.name]: FormItem,
    },
    props: {
        show: {
            type: Boolean,
            default: false,
        },
        reject: {
            type: Function,
            required: true,
        },
    },
    data() {
        return {
            loading: true,
            visible: this.show,
            content: {
                rejectReason: '',
            },
        };
    },
    watch: {
        visible() {
            this.$emit('update:show', this.visible);
        },
        show() {
            this.visible = this.show;
        },
    },
    methods: {
        onVisibleChange(visible) {
            if (visible) {
                this.content.rejectReason = '';
            }
        },
        stopLoading() {
            this.loading = false;
            this.$nextTick(() => {
                this.loading = true;
            });
        },
        onOk(rejectReason) {
            this.$refs.form.validate((valid) => {
                if (valid) {
                    this.reject(rejectReason)
                        .then(() => {
                        this.visible = false;
                    })
                        .catch(() => {
                        this.stopLoading();
                    });
                }
                else {
                    this.stopLoading();
                }
            });
        },
    },
};

</script>
<style lang="scss">
.reject-form-modal {
  display: flex;
  align-items: center;
  justify-content: center;

  .ivu-modal {
    top: -50px;
    .ivu-modal-body {
      padding-bottom: 22px;
    }
  }
  .reject-form {
    padding: 0;
    .ivu-form-item {
      margin-bottom: 0;
    }
  }
}
</style>